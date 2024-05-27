import { FilterQuery, Model } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Liquidities,
  LiquiditiesDocs,
} from '@schema/schema-app/schema/liquidity.schema';

import { DTOCreateLiquidity } from './dto/create-liquidity.dto';
import { DTOUpdateLiquidity } from './dto/update-liquidity.dto';

@Injectable()
export class LiquiditiesService {
  constructor(
    @InjectModel(Liquidities.name)
    private readonly liquidityModel: Model<LiquiditiesDocs>,
  ) {}

  async count(query: FilterQuery<Liquidities>) {
    return await this.liquidityModel.countDocuments(query);
  }

  async findAll(query: FilterQuery<Liquidities>) {
    return await this.liquidityModel.find(query);
  }

  async getLiquidity(query: FilterQuery<Liquidities>) {
    return await this.liquidityModel.findOne(query);
  }

  async create(data: DTOCreateLiquidity) {
    return await this.liquidityModel.create(data);
  }

  async insertMany(data: DTOCreateLiquidity[]) {
    return await this.liquidityModel.insertMany(data, {
      lean: true,
      rawResult: true,
    });
  }

  async update(query: FilterQuery<Liquidities>, data: DTOUpdateLiquidity) {
    return await this.liquidityModel.findOneAndUpdate(query, data, {
      lean: true,
      new: true,
    });
  }

  async deleteMany(query: FilterQuery<Liquidities>) {
    return await this.liquidityModel.deleteMany(query);
  }
}
