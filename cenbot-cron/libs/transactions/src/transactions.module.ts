import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Transactions,
  TransactionsSchema,
} from '@schema/schema-app/schema/transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transactions.name, schema: TransactionsSchema },
    ]),
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
