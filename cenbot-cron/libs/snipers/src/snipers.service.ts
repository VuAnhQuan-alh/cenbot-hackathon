import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Snipers, SnipersDocs } from '@schema/schema-app/schema/sniper.schema';
import { FilterQuery, Model } from 'mongoose';
import { DTOCreateSniper } from './dto/create-sniper.dto';
import { DTOUpdateSniper } from './dto/update-sniper.dto';

@Injectable()
export class SnipersService {
  constructor(
    @InjectModel(Snipers.name) private readonly sniperModel: Model<SnipersDocs>,
  ) {}

  async findAll(query: FilterQuery<Snipers>) {
    return await this.sniperModel.find(query).populate('userId');
  }

  async count(query: FilterQuery<Snipers>) {
    return await this.sniperModel.countDocuments(query);
  }

  async getSniper(query: FilterQuery<Snipers>) {
    return await this.sniperModel.findOne(query);
  }

  async create(data: DTOCreateSniper) {
    return await this.sniperModel.create(data);
  }

  async update(query: FilterQuery<Snipers>, data: DTOUpdateSniper) {
    return await this.sniperModel.findOneAndUpdate(query, data, {
      lean: true,
      new: true,
    });
  }

  async removeMany(ids: string[]) {
    return await this.sniperModel.deleteMany({ _id: { $in: ids } });
  }
}
