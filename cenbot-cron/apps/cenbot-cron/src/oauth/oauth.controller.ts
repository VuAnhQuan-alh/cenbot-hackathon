import axios from 'axios';
import { Response as Res } from 'express';

import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Response,
} from '@nestjs/common';

import { OauthService } from './oauth.service';

@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @Get('twitter')
  async callbackX(@Response() res: Res, @Query() query: any): Promise<any> {
    try {
      const baseUri = process.env.TWITTER_OAUTH_TOKEN_URL;
      const xOauthParams = {
        grant_type: 'authorization_code',
        client_id: process.env.CLIENT_ID,
        code_verifier: process.env.CODE_TWITTER_VERIFY,
        redirect_uri: process.env.X_CALLBACK_URL,
        code: query.code,
      };
      const url = new URLSearchParams(xOauthParams).toString();
      const token = Buffer.from(
        `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`,
        'utf8',
      ).toString('base64');

      const response = await axios.post(baseUri, url, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${token}`,
        },
      });

      const infoUrl = process.env.TWITTER_INFO_URL;
      const infoXUser = await axios.get(infoUrl, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${response.data.access_token}`,
        },
      });
      // console.log({ data: infoXUser.data.data });

      res.redirect(process.env.CLIENT_REDIRECT_URL);
      return this.oauthService.getOAuthCallback(
        Number(query.state),
        infoXUser.data.data,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
