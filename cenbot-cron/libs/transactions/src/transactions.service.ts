import { BadGatewayException, Injectable } from '@nestjs/common';
import { DTOCreateTransaction } from './dto/create-transaction.dto';
import { InjectModel } from '@nestjs/mongoose';
import {
  Transactions,
  TransactionsDocs,
} from '@schema/schema-app/schema/transaction.schema';
import { FilterQuery, Model } from 'mongoose';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transactions.name)
    private readonly transModel: Model<TransactionsDocs>,
  ) {}

  async getTransactions(query: FilterQuery<Transactions>) {
    try {
      return await this.transModel.find(query);
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }

  async create(data: DTOCreateTransaction) {
    try {
      return await this.transModel.create(data);
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }
}
