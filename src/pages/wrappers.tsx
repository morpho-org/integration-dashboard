import styled from "styled-components";

export const PageWrapper = styled.div`
  padding: 20px;
`;

export const FilterInput = styled.input`
  padding: 8px;
  font-size: 0.8em;
  border-radius: 4px;
  border: 1px solid #ccc;
  outline: none;
  width: 280px;
`;

export const MarketsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const VaultsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const TitleContainer = styled.div`
  flex-grow: 1;
  h1 {
    white-space: nowrap;
  }
`;

export const FilterContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
`;

export const HeaderWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

export const LinkList = styled.ol`
  margin-top: 10px;
  padding-left: 20px;
  flex-grow: 1;
`;

export const LinkItem = styled.li`
  margin-bottom: 5px;

  a {
    color: white;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;
