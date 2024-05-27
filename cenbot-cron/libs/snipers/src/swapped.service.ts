import { FilterQuery, Model } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Swapped, SwappedDocs } from '@schema/schema-app/schema/swapped.schema';

import { DTOCreateSwapped } from './dto/create-swapped.dto';
import { DTOUpdateSwapped } from './dto/update-swapped.dto';

@Injectable()
export class SwappedService {
  constructor(
    @InjectModel(Swapped.name) private readonly swapModel: Model<SwappedDocs>,
  ) {}

  async count(query: FilterQuery<Swapped>) {
    return await this.swapModel.countDocuments(query);
  }

  async findAll(query: FilterQuery<Swapped>) {
    return await this.swapModel.find(query);
  }

  async getSwap(query: FilterQuery<Swapped>) {
    return await this.swapModel.findOne(query);
  }

  async create(data: DTOCreateSwapped) {
    return await this.swapModel.create(data);
  }

  async insertMany(data: DTOCreateSwapped[]) {
    return await this.swapModel.insertMany(data);
  }

  async update(query: FilterQuery<Swapped>, data: DTOUpdateSwapped) {
    return await this.swapModel.findOneAndUpdate(query, data, {
      lean: true,
      new: true,
    });
  }

  async deleteMany(query: FilterQuery<Swapped>) {
    return await this.swapModel.deleteMany(query);
  }
}
