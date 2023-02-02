import { APIGatewayProxyHandler } from "aws-lambda";
import { document } from "../utils/dynamodbClient";
import { join } from "path";
import { compile } from "handlebars";
import { readFileSync } from "fs";
import dayjs from "dayjs";
import chromium from "chrome-aws-lambda";
import { S3 } from "aws-sdk";

interface ITemplate {
  id: string;
  name: string;
  grade: string;
  medal: string;
  date: string;
}
interface ICreateCertification {
  id: string;
  name: string;
  grade: string;
}

const compileTemplate = async (data: ITemplate) => {
  const filePath = join(process.cwd(), "src", "templates", "certification.hbs");

  const html = readFileSync(filePath, "utf-8");

  return compile(html)(data);
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertification;

  const response = await document
    .query({
      TableName: "users_certifications",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": id,
      },
    })
    .promise();

  const userAlreadyExists = response.Items[0];

  if (!userAlreadyExists) {
    await document
      .put({
        TableName: "users_certifications",
        Item: {
          id,
          name,
          grade,
          created_at: new Date().getTime(),
        },
      })
      .promise();
  }

  const medalPath = join(process.cwd(), "src", "templates", "selo.png");
  const medal = readFileSync(medalPath, "base64");

  const data: ITemplate = {
    id,
    name,
    grade,
    date: dayjs().format("DD/MM/YYYY"),
    medal,
  };

  const content = await compileTemplate(data);

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    userDataDir: "/dev/null",
  });

  const page = await browser.newPage();

  await page.setContent(content);

  const pdf = await page.pdf({
    format: "a4",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    path: process.env.IS_OFFLINE ? "./certification.pdf" : null,
  });

  browser.close();

  const s3 = new S3();

  await s3
    .putObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${id}.pdf`,
      ACL: "public-read",
      Body: pdf,
      ContentType: "application/pdf",
    })
    .promise();

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Certification successfully created!",
      url: `${process.env.AWS_BUCKET_URL}/${id}.pdf`,
    }),
  };
};
