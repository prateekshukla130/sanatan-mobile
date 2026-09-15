import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

const AnimatedView = Animated.createAnimatedComponent(View);

export const AnimatedDiya: React.FC = () => {
  const { colors } = useTheme();
  const flameScale = useSharedValue(1);
  const flameOpacity = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    // Flame flicker animation
    flameScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 400, easing: Easing.ease }),
        withTiming(0.95, { duration: 300, easing: Easing.ease }),
        withTiming(1.05, { duration: 350, easing: Easing.ease }),
        withTiming(1, { duration: 350, easing: Easing.ease })
      ),
      -1,
      false
    );

    flameOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.8, { duration: 300 }),
        withTiming(0.9, { duration: 350 }),
        withTiming(1, { duration: 350 })
      ),
      -1,
      false
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const flameStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: flameScale.value }],
      opacity: flameOpacity.value,
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      {/* Glow effect */}
      <AnimatedView
        style={[styles.glow, { backgroundColor: colors.diyaGlow }, glowStyle]}
      />
      
      <Svg width="100" height="120" viewBox="0 0 100 120">
        <Defs>
          <RadialGradient id="flameGradient" cx="50%" cy="50%">
            <Stop offset="0%" stopColor="#FFF59D" stopOpacity="1" />
            <Stop offset="30%" stopColor="#FFD54F" stopOpacity="1" />
            <Stop offset="60%" stopColor="#FF9800" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FF6B00" stopOpacity="0.9" />
          </RadialGradient>
        </Defs>
        
        {/* Diya base */}
        <Path
          d="M 30 80 Q 30 90, 50 90 Q 70 90, 70 80 L 65 70 L 35 70 Z"
          fill={colors.gold}
          stroke={colors.goldDark}
          strokeWidth="1"
        />
        
        {/* Diya rim */}
        <Path
          d="M 25 70 Q 25 65, 50 65 Q 75 65, 75 70 L 70 75 L 30 75 Z"
          fill={colors.goldLight}
          stroke={colors.goldDark}
          strokeWidth="1"
        />
        
        {/* Flame (will be animated in React Native) */}
        <AnimatedView style={flameStyle}>
          <Svg width="100" height="120" viewBox="0 0 100 120">
            <Path
              d="M 50 30 Q 45 40, 45 50 Q 45 60, 50 65 Q 55 60, 55 50 Q 55 40, 50 30 Z"
              fill="url(#flameGradient)"
            />
          </Svg>
        </AnimatedView>
        
        {/* Wick */}
        <Circle cx="50" cy="68" r="3" fill={colors.primaryDark} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -10,
  },
});
