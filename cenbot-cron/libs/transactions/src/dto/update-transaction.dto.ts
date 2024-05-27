import { PartialType } from '@nestjs/mapped-types';
import { DTOCreateTransaction } from './create-transaction.dto';

export class DTOUpdateTransaction extends PartialType(DTOCreateTransaction) {}
