import { Module } from '@nestjs/common';
import { DexSdkService } from './dex-sdk.service';

@Module({
  providers: [DexSdkService],
  exports: [DexSdkService],
})
export class DexSdkModule {}
