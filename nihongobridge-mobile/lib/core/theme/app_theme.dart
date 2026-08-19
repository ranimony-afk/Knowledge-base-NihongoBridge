import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract final class AppColors {
  static const Color washi = Color(0xFFFAFAF7);
  static const Color sumi = Color(0xFF1C1C1E);
  static const Color vermilion = Color(0xFFC0392B);
  static const Color moss = Color(0xFF4D6B57);
  static const Color amberInk = Color(0xFFB7791F);
  static const Color darkWashi = Color(0xFF141412);
  static const Color darkSurface = Color(0xFF211F1A);
}

abstract final class AppSpacing {
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
}

abstract final class AppRadii {
  static const double sm = 10;
  static const double md = 16;
  static const double lg = 24;
  static const double pill = 999;
}

abstract final class AppTheme {
  static ThemeData get light => _theme(Brightness.light);
  static ThemeData get dark => _theme(Brightness.dark);

  static ThemeData _theme(Brightness brightness) {
    final bool dark = brightness == Brightness.dark;
    final ColorScheme colors = ColorScheme.fromSeed(
      seedColor: AppColors.vermilion,
      brightness: brightness,
      primary: dark ? const Color(0xFFE06455) : AppColors.vermilion,
      surface: dark ? AppColors.darkWashi : AppColors.washi,
      onSurface: dark ? const Color(0xFFF4F1E8) : AppColors.sumi,
    ).copyWith(
      secondary: AppColors.moss,
      surfaceContainerLowest: dark ? AppColors.darkWashi : AppColors.washi,
      surfaceContainerLow:
          dark ? AppColors.darkSurface : const Color(0xFFF6F3EC),
      outlineVariant: dark
          ? Colors.white.withValues(alpha: 0.12)
          : AppColors.sumi.withValues(alpha: 0.10),
    );
    final TextTheme textTheme = GoogleFonts.notoSansJpTextTheme(
      ThemeData(brightness: brightness).textTheme,
    ).apply(
      bodyColor: colors.onSurface,
      displayColor: colors.onSurface,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colors,
      scaffoldBackgroundColor: colors.surface,
      textTheme: textTheme,
      visualDensity: VisualDensity.standard,
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        backgroundColor: colors.surface,
        foregroundColor: colors.onSurface,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: dark
            ? Colors.white.withValues(alpha: 0.045)
            : Colors.white.withValues(alpha: 0.72),
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          side: BorderSide(color: colors.outlineVariant),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.white.withValues(alpha: 0.72),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide(color: colors.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide(color: colors.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide(color: colors.primary, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(64, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          side: BorderSide(color: colors.outlineVariant),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: colors.surfaceContainerLow,
        shape: const StadiumBorder(),
        side: BorderSide(color: colors.outlineVariant),
        labelStyle:
            textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 0,
        backgroundColor: dark ? AppColors.darkSurface : AppColors.washi,
        indicatorColor: colors.primary.withValues(alpha: 0.12),
        labelTextStyle: WidgetStatePropertyAll<TextStyle?>(
          textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      dividerTheme: DividerThemeData(color: colors.outlineVariant, space: 1),
    );
  }
}
