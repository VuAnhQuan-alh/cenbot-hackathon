import { PartialType } from '@nestjs/mapped-types';
import { DTOCreateSwapped } from './create-swapped.dto';

export class DTOUpdateSwapped extends PartialType(DTOCreateSwapped) {}
