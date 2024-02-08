import { Test, TestingModule } from '@nestjs/testing';
import { FromlotService } from './fromlot.service';

describe('FromlotService', () => {
  let service: FromlotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FromlotService],
    }).compile();

    service = module.get<FromlotService>(FromlotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
