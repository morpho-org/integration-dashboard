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
  gap: 5px;
`;

export const VaultsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.8rem;
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

export const Select = styled.select`
  padding: 8px;
  font-size: 0.8em;
  border-radius: 4px;
  border: 1px solid #ccc;
  outline: none;
  background-color: white;
  cursor: pointer;

  &:hover {
    border-color: #aaa;
  }

  &:focus {
    border-color: #666;
  }
`;

export const SortButton = styled.button`
  margin-left: 10px;
  padding: 8px 16px;
  height: 40px;
  border-radius: 9999px;
  background: rgba(250, 250, 250, 0.1);
  color: white;
  font-size: 0.875rem;
  border: none;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  width: auto;
  white-space: nowrap;
  &:hover {
    background: rgba(250, 250, 250, 0.2);
  }

  &:focus {
    box-shadow: 0 0 0 2px #2973ff;
  }
`;
