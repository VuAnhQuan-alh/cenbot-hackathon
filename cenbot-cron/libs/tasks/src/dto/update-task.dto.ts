import { PartialType } from '@nestjs/mapped-types';
import { DTOCreateTask } from './create-task.dto';

export class DTOUpdateTask extends PartialType(DTOCreateTask) {}
