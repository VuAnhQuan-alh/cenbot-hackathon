import { Test, TestingModule } from '@nestjs/testing';
import { TaskCronService } from './task-cron.service';

describe('TaskCronService', () => {
  let service: TaskCronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskCronService],
    }).compile();

    service = module.get<TaskCronService>(TaskCronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
