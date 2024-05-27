import { Test, TestingModule } from '@nestjs/testing';
import { QueryEventsController } from './query-events.controller';
import { QueryEventsService } from './query-events.service';

describe('QueryEventsController', () => {
  let queryEventsController: QueryEventsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [QueryEventsController],
      providers: [QueryEventsService],
    }).compile();

    queryEventsController = app.get<QueryEventsController>(QueryEventsController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(queryEventsController.getHello()).toBe('Hello World!');
    });
  });
});
