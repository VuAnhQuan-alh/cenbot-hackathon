import { Test, TestingModule } from '@nestjs/testing';
import { InitModuleService } from './init-module.service';

describe('InitModuleService', () => {
  let service: InitModuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InitModuleService],
    }).compile();

    service = module.get<InitModuleService>(InitModuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
