import { describe, it, expect } from '@ohos/hypium';
import { TotpCodeGenerator } from '../../../main/ets/services/TotpCodeGenerator';

const RFC_SHA1_SECRET: string = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_SHA256_SECRET: string = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====';
const RFC_SHA512_SECRET: string = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA=';

export default function totpCodeGeneratorTest(): void {
  describe('TotpCodeGenerator', () => {
    it('matches RFC 6238 SHA1 test vectors', 0, () => {
      expect(TotpCodeGenerator.generate(RFC_SHA1_SECRET, 59_000, 30, 8, 'SHA1')).assertEqual('94287082');
      expect(TotpCodeGenerator.generate(RFC_SHA1_SECRET, 1_111_111_109_000, 30, 8, 'SHA1')).assertEqual('07081804');
      expect(TotpCodeGenerator.generate(RFC_SHA1_SECRET, 2_000_000_000_000, 30, 8, 'SHA1')).assertEqual('69279037');
    });

    it('matches RFC 6238 SHA256 test vectors', 0, () => {
      expect(TotpCodeGenerator.generate(RFC_SHA256_SECRET, 59_000, 30, 8, 'SHA256')).assertEqual('46119246');
      expect(TotpCodeGenerator.generate(RFC_SHA256_SECRET, 1_111_111_109_000, 30, 8, 'SHA256')).assertEqual('68084774');
      expect(TotpCodeGenerator.generate(RFC_SHA256_SECRET, 2_000_000_000_000, 30, 8, 'SHA256')).assertEqual('90698825');
    });

    it('matches RFC 6238 SHA512 test vectors', 0, () => {
      expect(TotpCodeGenerator.generate(RFC_SHA512_SECRET, 59_000, 30, 8, 'SHA512')).assertEqual('90693936');
      expect(TotpCodeGenerator.generate(RFC_SHA512_SECRET, 1_111_111_109_000, 30, 8, 'SHA512')).assertEqual('25091201');
      expect(TotpCodeGenerator.generate(RFC_SHA512_SECRET, 2_000_000_000_000, 30, 8, 'SHA512')).assertEqual('38618901');
    });

    it('supports six digit codes with the same RFC counter window', 0, () => {
      expect(TotpCodeGenerator.generate(RFC_SHA1_SECRET, 59_000, 30, 6, 'SHA1')).assertEqual('287082');
    });
  });
}
