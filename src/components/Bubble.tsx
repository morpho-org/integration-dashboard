import React from "react";
import styled from "styled-components";

const BubbleWrapper = styled.div<{ backgroundColor?: string }>`
  border-radius: 15px;
  padding: 10px;
  background-color: ${({ backgroundColor }) => backgroundColor || "#f0f0f0"};
  margin: 10px;
  cursor: pointer;
`;

type BubbleProps = {
  children: React.ReactNode;
  onClick?: () => void;
  backgroundColor?: string;
};

const Bubble: React.FC<BubbleProps> = ({
  children,
  onClick,
  backgroundColor,
}) => {
  return (
    <BubbleWrapper onClick={onClick} backgroundColor={backgroundColor}>
      {children}
    </BubbleWrapper>
  );
};

export default Bubble;
