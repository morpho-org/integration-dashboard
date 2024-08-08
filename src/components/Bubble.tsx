import React from "react";
import styled from "styled-components";

const BubbleWrapper = styled.div<{ $backgroundColor?: string }>`
  border-radius: 15px;
  padding: 10px;
  background-color: ${({ $backgroundColor }) => $backgroundColor || "#0f0f0f"};
  color: black;
  margin: 10px;
  cursor: pointer;

  a {
    color: white;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
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
    <BubbleWrapper onClick={onClick} $backgroundColor={backgroundColor}>
      {children}
    </BubbleWrapper>
  );
};

export default Bubble;
