import { TestBed } from '@angular/core/testing';
import { ACCOUNT_STORAGE_KEY, AccountService, initials, nameFromEmail } from './account.service';

describe('AccountService', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts as a guest', () => {
    const service = TestBed.inject(AccountService);
    expect(service.signedIn()).toBe(false);
    expect(service.account()).toBeNull();
  });

  it('creates an account and remembers it across visits, without any password', () => {
    TestBed.inject(AccountService).createAccount({
      name: ' Nick La Neve ',
      email: 'nick@lanemotors.ca',
      dealership: 'Lane Motors',
    });

    const stored = localStorage.getItem(ACCOUNT_STORAGE_KEY) ?? '';
    expect(stored).not.toMatch(/password/i);

    TestBed.resetTestingModule();
    const nextVisit = TestBed.inject(AccountService);
    expect(nextVisit.account()).toEqual({ name: 'Nick La Neve', email: 'nick@lanemotors.ca', dealership: 'Lane Motors' });
  });

  it('signs out but keeps the email to pre-fill the next sign-in', () => {
    const service = TestBed.inject(AccountService);
    service.createAccount({ name: 'Nick La Neve', email: 'nick@lanemotors.ca', dealership: 'Lane Motors' });
    service.signOut();

    expect(service.signedIn()).toBe(false);
    expect(service.lastEmail()).toBe('nick@lanemotors.ca');

    // Signing back in with the same address restores the details.
    expect(service.signIn('NICK@lanemotors.ca ').dealership).toBe('Lane Motors');
  });

  it('makes a name from an unfamiliar email', () => {
    expect(TestBed.inject(AccountService).signIn('sam.okafor@example.com').name).toBe('Sam Okafor');
  });
});

describe('account helpers', () => {
  it('turns an email address into a display name', () => {
    expect(nameFromEmail('nick.la-neve42@example.com')).toBe('Nick La Neve');
    expect(nameFromEmail('1234@example.com')).toBe('Dealer');
  });

  it('builds avatar initials', () => {
    expect(initials('Nick La Neve')).toBe('NN');
    expect(initials('cher')).toBe('C');
    expect(initials('  ')).toBe('?');
  });
});
