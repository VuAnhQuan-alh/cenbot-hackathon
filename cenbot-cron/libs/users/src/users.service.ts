import * as _ from 'lodash';
import { FilterQuery, Model } from 'mongoose';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Users, UsersDocs } from '@schema/schema-app/schema/users.schema';

import { DTOCreateUser } from './dto/create-user.dto';
import { DTOUpdateUser } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(Users.name) private readonly userModal: Model<UsersDocs>,
  ) {}

  async getOne(query: FilterQuery<Users>) {
    try {
      return await this.userModal.findOne(query);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async findAll(query: FilterQuery<Users>) {
    try {
      return await this.userModal.find(query);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getCountReferrer(code: string) {
    try {
      return await this.userModal.countDocuments({ referrer: code });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async create(data: DTOCreateUser) {
    try {
      return await this.userModal.create(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(query: FilterQuery<Users>, data: DTOUpdateUser) {
    try {
      return await this.userModal.findOneAndUpdate(query, data, {
        new: true,
        lean: true,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async plusPointForUser(query: FilterQuery<Users>, point: number) {
    try {
      const user = await this.userModal.findOne(query);
      if (!user) {
        return { data: null, message: 'User not found!' };
      }
      return await this.userModal.findOneAndUpdate(
        { _id: user._id },
        { point: user.point + point },
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getUserTopRank(botId?: number): Promise<number | Users[] | any> {
    try {
      const users = await this.userModal.find({ verify: true });
      const sorted = _.orderBy(users, 'point', 'desc');

      if (typeof botId === 'undefined') {
        return sorted.filter((_, idx) => idx < 10);
      }

      return sorted.findIndex((item) => item.botId === botId) + 1;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
