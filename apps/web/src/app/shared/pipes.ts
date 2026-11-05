import { Pipe, PipeTransform } from '@angular/core';
import { formatKm, formatMoney, humanize, provinceCode } from './format';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: number | null | undefined): string {
    return amount === null || amount === undefined ? '—' : formatMoney(amount);
  }
}

@Pipe({ name: 'km' })
export class KmPipe implements PipeTransform {
  transform(km: number): string {
    return formatKm(km);
  }
}

@Pipe({ name: 'province' })
export class ProvincePipe implements PipeTransform {
  transform(province: string): string {
    return provinceCode(province);
  }
}

@Pipe({ name: 'humanize' })
export class HumanizePipe implements PipeTransform {
  transform(value: string): string {
    return humanize(value);
  }
}
