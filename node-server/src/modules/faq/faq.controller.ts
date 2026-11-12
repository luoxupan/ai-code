import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateFaqDto } from './dto/create-faq.dto';
import { SearchFaqDto } from './dto/search-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { Faq } from './entities/faq.entity';
import { FaqSearchResult, FaqService } from './faq.service';

@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Post()
  create(@Body() createFaqDto: CreateFaqDto): Promise<Faq> {
    return this.faqService.create(createFaqDto);
  }

  @Get()
  findAll(): Promise<Faq[]> {
    return this.faqService.findAll();
  }

  @Post('search')
  search(@Body() searchFaqDto: SearchFaqDto): Promise<FaqSearchResult[]> {
    return this.faqService.search(searchFaqDto.query, searchFaqDto.topK);
  }

  @Post('reindex')
  reindex(): Promise<{ indexed: number }> {
    return this.faqService.reindex();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Faq> {
    return this.faqService.findOne(+id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateFaqDto: UpdateFaqDto,
  ): Promise<Faq> {
    return this.faqService.update(+id, updateFaqDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.faqService.remove(+id);
  }
}
