import { FilterQuery, Model } from 'mongoose';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Wallets, WalletsDocs } from '@schema/schema-app/schema/wallets.schema';

import { DTOCreateWallet } from './dto/create-wallet.dto';
import { DTOUpdateWallet } from './dto/update-wallet.dto';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallets.name) private readonly walletModel: Model<WalletsDocs>,
  ) {}

  async getWallets(query: FilterQuery<Wallets>) {
    try {
      return await this.walletModel.find(query);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getWal(query: FilterQuery<Wallets>) {
    try {
      return await this.walletModel.findOne(query);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getUserForAddress(query: FilterQuery<Wallets>) {
    return await this.walletModel.findOne(query).populate('ownerId');
  }

  async create(data: DTOCreateWallet) {
    try {
      return await this.walletModel.create(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(query: FilterQuery<Wallets>, data: DTOUpdateWallet) {
    try {
      return await this.walletModel.findOneAndUpdate(query, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async updateMany(query: FilterQuery<Wallets>, data: DTOUpdateWallet) {
    try {
      return await this.walletModel.updateMany(query, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
