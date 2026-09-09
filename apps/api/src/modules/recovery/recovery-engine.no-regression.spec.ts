import { RecoveryEngineService } from './recovery-engine.service';
import { RecoveryImpactType } from '@prisma/client';

describe('Recovery preserves the existing grade', () => {
  const engine = new RecoveryEngineService({} as any, {} as any);
  it.each(['ADJUST_TO_MINIMUM', 'AVERAGE_WITH_ORIGINAL', 'REPLACE_IF_HIGHER', 'QUALITATIVE_ONLY'] as RecoveryImpactType[])(
    '%s cannot lower a grade when the recovery result is worse', (impactType) => {
      expect(engine.calculateRecoveryImpact({ originalScore: 2.8, recoveryScore: 1,
        maxScore: 3, minPassingScore: 3, impactType }).finalScore).toBe(2.8);
    },
  );
  it('a recovery cap does not truncate a pre-existing higher grade', () => {
    expect(engine.calculateRecoveryImpact({ originalScore: 4, recoveryScore: 5,
      maxScore: 3, minPassingScore: 3, impactType: 'REPLACE_IF_HIGHER' })).toEqual({ finalScore: 4, status: 'APPROVED' });
  });
  it.each([
    ['ADJUST_TO_MINIMUM', 3], ['AVERAGE_WITH_ORIGINAL', 3],
    ['REPLACE_IF_HIGHER', 4], ['QUALITATIVE_ONLY', 2],
  ] as [RecoveryImpactType, number][] )('preserves the intended benefit of %s', (impactType, expected) => {
    expect(engine.calculateRecoveryImpact({ originalScore: 2, recoveryScore: 4,
      maxScore: 5, minPassingScore: 3, impactType }).finalScore).toBe(expected);
  });
});
