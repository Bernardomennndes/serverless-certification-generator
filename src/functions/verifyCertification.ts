import { APIGatewayProxyHandler } from "aws-lambda";
import { document } from "../utils/dynamodbClient";

interface IUserCertification {
  id: string;
  name: string;
  grade: string;
  date: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { id } = event.pathParameters;

  const response = await document
    .query({
      TableName: "users_certifications",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": id,
      },
    })
    .promise();

  const userCertification = response.Items[0] as IUserCertification;

  if (userCertification) {
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Valid certification.",
        name: userCertification.name,
        url: `${process.env.AWS_BUCKET_URL}/${userCertification.id}.pdf`,
      }),
    };
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      message: "Invalid certification.",
    }),
  };
};
