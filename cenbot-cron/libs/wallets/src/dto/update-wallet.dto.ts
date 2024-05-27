import { PartialType } from '@nestjs/mapped-types';
import { DTOCreateWallet } from './create-wallet.dto';

export class DTOUpdateWallet extends PartialType(DTOCreateWallet) {}
