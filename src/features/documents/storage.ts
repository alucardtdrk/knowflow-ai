import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

function storage() {
  for (const key of [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ])
    if (!process.env[key]) throw new Error(`Configure ${key}.`);
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}
export async function ensureBucket() {
  const client = storage();
  try {
    await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
  } catch (e) {
    if (
      (e as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode !== 404
    )
      throw e;
    await client.send(
      new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }),
    );
  }
}
export async function putObject(key: string, data: Uint8Array) {
  await storage().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: data,
      ContentType: "application/octet-stream",
    }),
  );
}
export async function getObject(key: string) {
  const result = await storage().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
  if (!result.Body) throw new Error("Arquivo indisponível.");
  return result.Body.transformToByteArray();
}
export async function deleteObject(key: string) {
  await storage().send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}
