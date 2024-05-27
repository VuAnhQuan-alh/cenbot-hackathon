import { FilterQuery, Model } from 'mongoose';

import { BadGatewayException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Tasks, TasksDocs } from '@schema/schema-app/schema/task.schema';

import { DTOCreateTask } from './dto/create-task.dto';
import { DTOUpdateTask } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Tasks.name) private readonly taskModel: Model<TasksDocs>,
  ) {}

  async findAll(query: FilterQuery<Tasks>) {
    try {
      return await this.taskModel.find(query).populate('userId');
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }

  async find(query: FilterQuery<Tasks>) {
    try {
      return await this.taskModel.find(query);
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }

  async getTask(query: FilterQuery<Tasks>) {
    try {
      return await this.taskModel.findOne(query);
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }

  async create(data: DTOCreateTask) {
    try {
      return await this.taskModel.create(data);
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }

  async update(query: FilterQuery<Tasks>, data: DTOUpdateTask) {
    try {
      return await this.taskModel.findOneAndUpdate(query, data);
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }
}
