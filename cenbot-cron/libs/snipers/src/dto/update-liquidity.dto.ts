import { PartialType } from '@nestjs/mapped-types';
import { DTOCreateLiquidity } from './create-liquidity.dto';

export class DTOUpdateLiquidity extends PartialType(DTOCreateLiquidity) {}
