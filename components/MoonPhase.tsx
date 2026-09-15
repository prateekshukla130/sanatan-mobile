import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme';

interface MoonPhaseProps {
  phase: number; // 0 to 1 (0 = new moon, 0.5 = full moon, 1 = new moon)
  size?: number;
}

export const MoonPhase: React.FC<MoonPhaseProps> = ({ phase, size = 60 }) => {
  const { colors } = useTheme();
  // Calculate the shadow path based on phase
  const getShadowPath = (phase: number): string => {
    // Normalize phase to 0-1
    const normalizedPhase = phase % 1;
    
    // 0 = new moon (fully dark)
    // 0.25 = waxing crescent
    // 0.5 = full moon (fully light)
    // 0.75 = waning crescent
    // 1 = new moon (fully dark)
    
    if (normalizedPhase < 0.5) {
      // Waxing (moon getting fuller)
      const offset = (0.5 - normalizedPhase) * 2; // 1 to 0
      return `M ${size/2} 0 A ${size/2} ${size/2} 0 0 1 ${size/2} ${size} A ${size/2 * offset} ${size/2} 0 0 1 ${size/2} 0`;
    } else {
      // Waning (moon getting darker)
      const offset = (normalizedPhase - 0.5) * 2; // 0 to 1
      return `M ${size/2} 0 A ${size/2} ${size/2} 0 0 0 ${size/2} ${size} A ${size/2 * offset} ${size/2} 0 0 0 ${size/2} 0`;
    }
  };

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Full moon circle (background) */}
        <Circle
          cx={size/2}
          cy={size/2}
          r={size/2 - 2}
          fill={colors.moonLight}
          stroke={colors.gold}
          strokeWidth="1"
        />
        
        {/* Shadow overlay */}
        <Path
          d={getShadowPath(phase)}
          fill={colors.bgPrimary}
          opacity={0.7}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
