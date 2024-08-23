import React, { useState } from "react";
import Bubble from "./Bubble";
import { MarketReallocationData, MetaMorphoVault } from "../utils/types";
import { formatTokenAmount, formatWAD } from "../utils/utils";

type MarketReallocationDataBubbleProps = {
  market: MarketReallocationData;
  vault: MetaMorphoVault;
};

const MarketReallocationDataBubble: React.FC<
  MarketReallocationDataBubbleProps
> = ({ market, vault }) => {
  const [expanded, setExpanded] = useState(false);
  const backgroundColor = market.warnings ? "red" : "#5782ff";

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <Bubble backgroundColor={backgroundColor} onClick={handleClick}>
      <p>
        <a href={market.link} target="_blank" rel="noopener noreferrer">
          {market.name}
        </a>
      </p>

      {expanded && (
        <>
          <p>
            Amount that can be{" "}
            {market.supplyReallocation ? "withdrawn from" : "supplied into"} the
            market:{" "}
            {formatTokenAmount(
              market.maxReallocationAmount,
              vault.underlyingAsset
            )}
          </p>
          <p>
            {market.supplyReallocation ? "Max out" : "Max in"} Flow cap:{" "}
            {formatTokenAmount(market.flowCap, vault.underlyingAsset)}
          </p>
          {market.supplyReallocation && (
            <p>
              Assets supplied by the vault:{" "}
              {formatTokenAmount(market.supplyAssets, vault.underlyingAsset)}
            </p>
          )}
          {!market.supplyReallocation && (
            <p>
              Assets to reach supply Cap:{" "}
              {formatTokenAmount(
                market.amountToReachCap,
                vault.underlyingAsset
              )}
            </p>
          )}
          <p>{getTargetMessage(market)}</p>
          {market.warnings && <p>{getWarningMessage(market)}</p>}
        </>
      )}
    </Bubble>
  );
};

const getWarningMessage = (market: MarketReallocationData) => {
  if (!market.warnings) {
    return "";
  } else {
    const warnings = [];
    if (market.warnings.targetTooCloseOrAlreadyCrossed) {
      warnings.push("The target is too close or already crossed");
    }
    if (market.warnings.flowCapTooLow) {
      warnings.push("The flow cap is insufficient");
    }
    if (market.warnings.allocationOrCapInsufficient) {
      warnings.push(
        `The ${
          market.supplyAssets ? "allocation" : "supply cap"
        } is insufficient`
      );
    }
    return `warnings: ${warnings.join(", ")}`;
  }
};

const getTargetMessage = (market: MarketReallocationData) => {
  if ("utilization" in market.target)
    return `Market utilization ${formatWAD(
      market.target.utilization
    )} (target: ${formatWAD(market.target.utilizationTarget)})`;
  else
    return `Market borrow APY ${formatWAD(
      market.target.borrowApy
    )} (target: ${formatWAD(market.target.apyTarget)})`;
};

export default MarketReallocationDataBubble;
