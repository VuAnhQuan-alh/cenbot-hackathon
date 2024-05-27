import { PartialType } from '@nestjs/mapped-types';
import { DTOCreateSniper } from './create-sniper.dto';

export class DTOUpdateSniper extends PartialType(DTOCreateSniper) {}
