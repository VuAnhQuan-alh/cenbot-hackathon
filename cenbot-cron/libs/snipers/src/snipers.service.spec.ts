import { Test, TestingModule } from '@nestjs/testing';
import { SnipersService } from './snipers.service';

describe('SnipersService', () => {
  let service: SnipersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SnipersService],
    }).compile();

    service = module.get<SnipersService>(SnipersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
