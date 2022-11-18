import { ListObjectsCommand, S3Client } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "ap-northeast-1" });

const handler = async (event) => {
    const command = new ListObjectsCommand({
        Bucket: process.env.BUCKET_NAME,
        Delimiter: '/',
    });
    try {
        const response = await client.send(command);

        return {
            statusCode: 200,
            body: JSON.stringify(response),
        }
    } catch (error) {
        throw error;
    }
}
module.exports = { handler }
