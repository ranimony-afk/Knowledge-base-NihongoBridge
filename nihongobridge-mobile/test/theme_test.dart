import 'package:flutter_test/flutter_test.dart';
import 'package:nihongobridge_mobile/core/theme/app_theme.dart';

void main() {
  test('preserves the NihongoBridge design token contract', () {
    expect(AppColors.washi.toARGB32(), 0xFFFAFAF7);
    expect(AppColors.sumi.toARGB32(), 0xFF1C1C1E);
    expect(AppColors.vermilion.toARGB32(), 0xFFC0392B);
    expect(AppColors.darkWashi.toARGB32(), 0xFF141412);
    expect(AppSpacing.md, 16);
    expect(AppRadii.lg, 24);
  });
}
