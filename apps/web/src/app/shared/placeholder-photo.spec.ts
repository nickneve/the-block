import { contrast, mixHex, paintColor } from './paint';
import { photoTint, resizedPhoto, tintedPhoto } from './placeholder-photo';

describe('placeholder photos', () => {
  const placeholder = 'https://placehold.co/800x600/1a1a2e/eaeaea?text=2023+Ford+Bronco+Photo+1';

  it('uses quiet theme greys when the colour is unknown', () => {
    expect(tintedPhoto(placeholder, photoTint('light'))).toBe(
      'https://placehold.co/800x600/dfe5ee/66728a?text=2023+Ford+Bronco+Photo+1',
    );
    expect(tintedPhoto(placeholder, photoTint('dark', 'Unobtainium'))).toContain('/800x600/222d4a/9aa6bd?');
  });

  it('tints the photo with the car’s paint, keeping the text readable', () => {
    const red = photoTint('light', 'Rapid Red');
    expect(red).toEqual(photoTint('light', 'Red'));
    expect(red.background).not.toBe('#dfe5ee');

    for (const colour of ['Shadow Black', 'Pearl White', 'Grey', 'Celestial Silver', 'Midnight Blue', 'Champagne']) {
      for (const theme of ['light', 'dark'] as const) {
        const { background, text } = photoTint(theme, colour);
        expect(contrast(background, text)).toBeGreaterThan(3);
      }
    }
  });

  it('asks for a bigger placeholder for full-screen viewing', () => {
    expect(resizedPhoto(placeholder, 1600, 1200)).toBe('https://placehold.co/1600x1200/1a1a2e/eaeaea?text=2023+Ford+Bronco+Photo+1');
    expect(resizedPhoto('https://cdn.example.com/front.jpg', 1600, 1200)).toBe('https://cdn.example.com/front.jpg');
  });

  it('leaves real photo URLs alone', () => {
    const real = 'https://cdn.example.com/lots/A-0043/front.jpg';
    expect(tintedPhoto(real, photoTint('dark', 'Blue'))).toBe(real);
  });
});

describe('paint colours', () => {
  it('matches names by keyword, most specific first', () => {
    expect(paintColor('Midnight Blue')).toBe(paintColor('Dark Blue'));
    expect(paintColor('Dark Blue')).not.toBe(paintColor('Blue'));
    expect(paintColor('Magnetic Grey')).toBe(paintColor('Grey'));
    expect(paintColor('Unobtainium')).toBeNull();
  });

  it('mixes colours', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#102030', 0.3)).toBe('#102030');
  });
});
