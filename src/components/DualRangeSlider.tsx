import React, { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";

// Props interface for the DualRangeSlider component
interface DualRangeSliderProps {
  minValue: number; // Current minimum selected value
  maxValue: number; // Current maximum selected value
  onChange: (values: [number, number]) => void; // Callback when values change
  min?: number; // Minimum possible value (default: 0)
  max?: number; // Maximum possible value (default: 14)
  step?: number; // Step increment (default: 1)
  label?: string; // Optional label text
}

// Styled components for the slider
const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const RangeLabel = styled.div`
  color: white;
  font-size: 0.875rem;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
`;

const SliderTrackContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 10px;
  position: relative;
  height: 60px; /* Increased height to accommodate the value indicators above thumbs */
`;

const SliderValue = styled.div`
  color: white;
  font-size: 0.775rem;
  width: 70px; /* Increased to fit longer text */
  text-align: center;
`;

const SliderTrack = styled.div`
  position: absolute;
  width: 100%;
  height: 5px;
  background: rgba(
    250,
    250,
    250,
    0.1
  ); /* Updated to match UI grey background */
  border-radius: 5px;
  top: 40px; /* Positioned lower to make room for the value indicators */
`;

const SliderRange = styled.div<{ left: number; right: number }>`
  position: absolute;
  height: 5px;
  left: ${(props) => props.left}%;
  right: ${(props) => 100 - props.right}%;
  background: rgba(41, 115, 255, 0.6);
  border-radius: 5px;
  top: 40px; /* Match with SliderTrack */
`;

const ThumbValue = styled.div<{ position: number }>`
  position: absolute;
  left: ${(props) => props.position}%;
  top: 0px; /* Position at top */
  transform: translateX(-50%);
  color: white;
  font-size: 0.775rem;
  white-space: nowrap;
`;

const Thumb = styled.div<{ position: number }>`
  position: absolute;
  left: ${(props) => props.position}%;
  top: 40px; /* Match with SliderTrack */
  width: 18px;
  height: 18px;
  background-color: #2973ff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  cursor: pointer;
`;

/**
 * DualRangeSlider - A component that allows selection of a range between two values
 */
export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  minValue,
  maxValue,
  onChange,
  min = 0,
  max = 14,
  step = 1,
  label,
}) => {
  // Refs for DOM elements
  const trackRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLDivElement>(null);
  const minThumbRef = useRef<HTMLDivElement>(null);
  const maxThumbRef = useRef<HTMLDivElement>(null);

  // Track if thumbs are currently being dragged
  const isDraggingMin = useRef(false);
  const isDraggingMax = useRef(false);

  // Reference to the overall range
  const range = max - min;

  // Memoized function to calculate percentage position
  const getPercent = useMemo(
    () => (value: number) => ((value - min) / range) * 100,
    [min, range]
  );

  // Update the position of the range element
  useEffect(() => {
    if (rangeRef.current) {
      const minPercent = getPercent(minValue);
      const maxPercent = getPercent(maxValue);

      rangeRef.current.style.left = `${minPercent}%`;
      rangeRef.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minValue, maxValue, getPercent]);

  // Calculate new value based on mouse/touch position
  const calculateNewValue = (clientX: number): number => {
    if (!trackRef.current) return 0;

    const { left, width } = trackRef.current.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(100, ((clientX - left) / width) * 100)
    );

    // Calculate the value based on the percentage and step
    const rawValue = min + (range * percent) / 100;
    const steppedValue = Math.round(rawValue / step) * step;

    return Math.max(min, Math.min(max, steppedValue));
  };

  // Event handlers for thumbs
  const handleMinThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingMin.current = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMaxThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingMax.current = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingMin.current && !isDraggingMax.current) return;

    const newValue = calculateNewValue(e.clientX);

    if (isDraggingMin.current) {
      // Ensure minValue doesn't exceed maxValue - step
      const newMinValue = Math.min(newValue, maxValue - step);
      onChange([newMinValue, maxValue]);
    } else {
      // Ensure maxValue doesn't fall below minValue + step
      const newMaxValue = Math.max(newValue, minValue + step);
      onChange([minValue, newMaxValue]);
    }
  };

  const handleMouseUp = () => {
    isDraggingMin.current = false;
    isDraggingMax.current = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  // Handle track click to set closest thumb position
  const handleTrackClick = (e: React.MouseEvent) => {
    const newValue = calculateNewValue(e.clientX);

    // Determine which thumb to move based on click position
    if (Math.abs(newValue - minValue) < Math.abs(newValue - maxValue)) {
      onChange([Math.min(newValue, maxValue - step), maxValue]);
    } else {
      onChange([minValue, Math.max(newValue, minValue + step)]);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, isMinThumb: boolean) => {
    let newMinValue = minValue;
    let newMaxValue = maxValue;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        if (isMinThumb) {
          newMinValue = Math.max(min, minValue - step);
        } else {
          newMaxValue = Math.max(minValue + step, maxValue - step);
        }
        break;
      case "ArrowRight":
      case "ArrowUp":
        if (isMinThumb) {
          newMinValue = Math.min(maxValue - step, minValue + step);
        } else {
          newMaxValue = Math.min(max, maxValue + step);
        }
        break;
      default:
        return;
    }

    onChange([newMinValue, newMaxValue]);
    e.preventDefault();
  };

  return (
    <SliderContainer>
      {label && (
        <RangeLabel>
          <span>{label}</span>
        </RangeLabel>
      )}

      <SliderTrackContainer>
        <SliderValue
          style={{ marginRight: "1rem", transform: "translateY(10px)" }}
        >
          min: {min}
        </SliderValue>

        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {/* Track background */}
          <SliderTrack ref={trackRef} onClick={handleTrackClick} />

          {/* Active range */}
          <SliderRange
            ref={rangeRef}
            left={getPercent(minValue)}
            right={getPercent(maxValue)}
          />

          {/* Value indicators above thumbs */}
          <ThumbValue position={getPercent(minValue)}>{minValue}</ThumbValue>

          <ThumbValue position={getPercent(maxValue)}>{maxValue}</ThumbValue>

          {/* Min thumb */}
          <Thumb
            ref={minThumbRef}
            position={getPercent(minValue)}
            onMouseDown={handleMinThumbMouseDown}
            onKeyDown={(e) => handleKeyDown(e, true)}
            tabIndex={0}
            role="slider"
            aria-valuenow={minValue}
            aria-valuemin={min}
            aria-valuemax={maxValue - step}
            aria-label={`Minimum value`}
          />

          {/* Max thumb */}
          <Thumb
            ref={maxThumbRef}
            position={getPercent(maxValue)}
            onMouseDown={handleMaxThumbMouseDown}
            onKeyDown={(e) => handleKeyDown(e, false)}
            tabIndex={0}
            role="slider"
            aria-valuenow={maxValue}
            aria-valuemin={minValue + step}
            aria-valuemax={max}
            aria-label={`Maximum value`}
          />
        </div>

        <SliderValue
          style={{
            marginLeft: "1rem",
            transform: "translateY(10px)",
            whiteSpace: "nowrap",
          }}
        >
          max: {max}
        </SliderValue>
      </SliderTrackContainer>
    </SliderContainer>
  );
};

export default DualRangeSlider;
