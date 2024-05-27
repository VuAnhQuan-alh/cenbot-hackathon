import { Test, TestingModule } from '@nestjs/testing';
import { DexSdkService } from './dex-sdk.service';

describe('DexSdkService', () => {
  let service: DexSdkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DexSdkService],
    }).compile();

    service = module.get<DexSdkService>(DexSdkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
