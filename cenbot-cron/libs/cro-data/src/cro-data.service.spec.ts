import { Test, TestingModule } from '@nestjs/testing';
import { CroDataService } from './cro-data.service';

describe('CroDataService', () => {
  let service: CroDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CroDataService],
    }).compile();

    service = module.get<CroDataService>(CroDataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
