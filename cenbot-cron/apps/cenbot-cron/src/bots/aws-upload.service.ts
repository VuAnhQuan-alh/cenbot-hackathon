import { S3 } from 'aws-sdk';

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AwsUploadService {
  private s3: S3;
  private bucketName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.s3 = new S3({
      accessKeyId: this.config.getOrThrow<string>('AWS_S3_ACCESS_KEY'),
      secretAccessKey: this.config.getOrThrow<string>('AWS_S3_SECRET_KEY'),
      region: this.config.getOrThrow<string>('AWS_S3_REGION'),
    });
    this.bucketName = this.config.getOrThrow<string>('AWS_S3_BUCKET');
  }

  async uploadFile(file: Express.Multer.File, snipeId: string) {
    const uui = uuidv4();
    const params = {
      Bucket: this.bucketName,
      Key: uui,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    const url = this.config.getOrThrow<string>('BE_URL');
    const uri = `${url}/bot/snipe/${snipeId}/${uui}`;

    await this.s3
      .upload(params)
      .promise()
      .then(async () => await this.http.axiosRef.get(uri));
  }
}
