import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { CroDataService } from './cro-data.service';

@Module({
  imports: [HttpModule],
  providers: [CroDataService],
  exports: [CroDataService],
})
export class CroDataModule {}
