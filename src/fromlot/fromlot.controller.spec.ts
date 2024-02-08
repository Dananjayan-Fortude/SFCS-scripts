import { Test, TestingModule } from '@nestjs/testing';
import { FromlotController } from './fromlot.controller';

describe('FromlotController', () => {
  let controller: FromlotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FromlotController],
    }).compile();

    controller = module.get<FromlotController>(FromlotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
