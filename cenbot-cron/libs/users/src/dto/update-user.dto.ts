import { PartialType } from '@nestjs/mapped-types';
import { DTOCreateUser } from './create-user.dto';

export class DTOUpdateUser extends PartialType(DTOCreateUser) {}
