import { useState, useEffect, useContext } from "react";
import type { Market, TokenPair } from "~/types/global";
import type { JsonRpcSigner } from "@ethersproject/providers";
import {
  calculateApy,
  formatApy,
} from "~/lib/apy-calculations";
import {
  getBorrowLimitUsed,
  formatBigNumber,
} from "~/lib/tender";
import { useInterval } from "./use-interval";
import { TenderContext } from "~/contexts/tender-context";
import {ethers, utils} from "ethers";
import SampleCTokenAbi from "~/config/sample-ctoken-abi";
import SampleCEtherAbi from "~/config/sample-CEther-abi";
import SampleComptrollerAbi from "~/config/sample-comptroller-abi";
import { providers as mcProviders } from '@0xsequence/multicall';
import {formatUnits} from "ethers/lib/utils";
import SampleErc20Abi from "~/config/sample-erc20-abi";

// @todo maybe refactor (remove duplicate code from tender.ts, merge changes, etc.)
export function useMarkets(
  signer: JsonRpcSigner | null | undefined,
  supportedTokenPairs: TokenPair[],
  comptrollerAddress: string | undefined,
  secondsPerBlock: number | undefined
) {
  let [markets, setMarkets] = useState<Market[]>([]);

  let pollingKey = useInterval(7_000);
  let { currentTransaction } = useContext(TenderContext);

  useEffect(() => {
    if (!signer || !comptrollerAddress || !secondsPerBlock) {
      return;
    }

    const mcProvider = new mcProviders.MulticallProvider(signer.provider);

    const getMarkets = async () => {
      const comptrollerContract = new ethers.Contract(
          comptrollerAddress,
          SampleComptrollerAbi,
          mcProvider
      );

      const address: string = await signer.getAddress();

      const tokenPromises = supportedTokenPairs.map((tp) => {
        const abi = tp.token.symbol === "ETH" ? SampleCEtherAbi : SampleCTokenAbi;
        const cTokenContract = new ethers.Contract(
            tp.cToken.address,
            abi,
            mcProvider
        );

        // getTotalBorrowedInUsd -> getCurrentlyBorrowing
        const borrowBalancePromise = cTokenContract.borrowBalanceStored(address);

        // getAccountBorrowLimitInUsd -> borrowLimitForTokenInUsd ->
        // -> getCurrentlySupplying
        const balancePromise = cTokenContract.callStatic.balanceOf(address);
        const exchangeRateCurrentPromise = cTokenContract.exchangeRateStored();

        // -> collateralFactorForToken
        const collateralFactorPromise = comptrollerContract.markets(tp.cToken.address);

        // getCurrentlySupplying -> ...
        // getCurrentlyBorrowing -> ...

        // getMaxBorrowLiquidity
        let cashPromise = cTokenContract.getCash();

        // getMarketData ->
        // -> formattedDepositApy -> calculateDepositApy
        const supplyRatePerBlockPromise = cTokenContract.supplyRatePerBlock();

        // -> formattedBorrowApy -> calculateBorrowApy
        const borrowRatePerBlockPromise = cTokenContract.borrowRatePerBlock();

        // -> getTotalBorrowed
        const totalBorrowsPromise = cTokenContract.totalBorrows();

        // -> getTotalSupply
        const totalReservesPromise = cTokenContract.totalReserves();

        // getWalletBalance
        let walletBalancePromise;

        if (tp.token.symbol === "ETH") {
          walletBalancePromise = signer.getBalance();
        } else {
          const tokenContract = new ethers.Contract(
              tp.token.address,
              SampleErc20Abi,
              mcProvider
          );
          walletBalancePromise = tokenContract.balanceOf(address);
        }

        return {
          borrowBalance: borrowBalancePromise,
          balance: balancePromise,
          exchangeRateCurrent: exchangeRateCurrentPromise,
          collateralFactor: collateralFactorPromise,
          cash: cashPromise,
          supplyRatePerBlock: supplyRatePerBlockPromise,
          borrowRatePerBlock: borrowRatePerBlockPromise,
          totalBorrows: totalBorrowsPromise,
          totalReserves: totalReservesPromise,
          tokenPair: tp,
          walletBalance: walletBalancePromise,
        };
      });

      const tokens = [];

      for (const tokenPromise of tokenPromises) {
        tokens.push({
          borrowBalance: await tokenPromise.borrowBalance,
          balance: await tokenPromise.balance,
          exchangeRateCurrent: await tokenPromise.exchangeRateCurrent,
          collateralFactor: await tokenPromise.collateralFactor,
          cash: await tokenPromise.cash,
          supplyRatePerBlock: await tokenPromise.supplyRatePerBlock,
          borrowRatePerBlock: await tokenPromise.borrowRatePerBlock,
          totalBorrows: await tokenPromise.totalBorrows,
          totalReserves: await tokenPromise.totalReserves,
          tokenPair: tokenPromise.tokenPair,
          walletBalance: await tokenPromise.walletBalance,
        });
      }

      // getTotalBorrowedInUsd
      const totalBorrowedAmountInUsd = tokens.map((token) => {
        return formatBigNumber(
            token.borrowBalance,
            token.tokenPair.token.decimals
        ) * token.tokenPair.token.priceInUsd;
      }).reduce((acc, curr) => acc + curr, 0);

      // getAccountBorrowLimitInUsd
      const accountBorrowLimitInUsd = tokens.map((token) => {
        // the exchange rate is scaled by 18 decimals
        const suppliedAmount = formatBigNumber(
            token.balance.mul(token.exchangeRateCurrent),
            token.tokenPair.token.decimals + 18
        );

        const collateralFactor = parseFloat(
            formatUnits(token.collateralFactor.collateralFactorMantissa, 18)
        );

        return suppliedAmount * token.tokenPair.token.priceInUsd * collateralFactor;
      }).reduce((acc, curr) => acc + curr, 0);

      const newMarkets = tokens.map(async (token): Promise<Market> => {
        const tp = token.tokenPair;
        const supplyBalance = formatBigNumber(
            token.balance.mul(token.exchangeRateCurrent),
            tp.token.decimals + 18
        );

        const borrowBalance = formatBigNumber(
            token.borrowBalance,
            tp.token.decimals
        );

        const supplyBalanceInUsd = supplyBalance * tp.token.priceInUsd;
        const borrowBalanceInUsd = borrowBalance * tp.token.priceInUsd;

        const maxBorrowLiquidity = parseFloat(utils.formatUnits(token.cash, tp.token.decimals));

        // walletBalance
        let walletBalance;

        if (tp.token.symbol === "ETH")  {
          walletBalance = parseFloat(
              ethers.utils.formatEther(token.walletBalance)
          );
        } else {
          walletBalance = formatBigNumber(token.walletBalance, tp.token.decimals);
        }

        // marketData
        const depositApy = formatApy(
            calculateApy(token.supplyRatePerBlock, secondsPerBlock)
        );

        const borrowApy = formatApy(
            calculateApy(token.borrowRatePerBlock, secondsPerBlock)
        );

        const totalBorrowed = formatBigNumber(token.totalBorrows, token.tokenPair.token.decimals);

        let marketSize = formatBigNumber(
            token.cash.add(token.totalBorrows).sub(token.totalReserves),
            token.tokenPair.token.decimals
        );

        return {
          id: tp.token.symbol,
          tokenPair: tp,
          marketData: {
            depositApy,
            borrowApy,
            totalBorrowed,
            marketSize,
          },
          walletBalance: walletBalance,
          supplyBalance,
          supplyBalanceInUsd,
          borrowBalance,
          borrowBalanceInUsd,
          comptrollerAddress,
          borrowLimit: accountBorrowLimitInUsd,
          totalBorrowedAmountInUsd,
          borrowLimitUsedOfToken: await getBorrowLimitUsed(
              borrowBalanceInUsd,
              accountBorrowLimitInUsd
          ),
          borrowLimitUsed: await getBorrowLimitUsed(
              totalBorrowedAmountInUsd,
              accountBorrowLimitInUsd
          ),
          maxBorrowLiquidity,
        };
      });

      Promise.all(newMarkets).then((nm) => setMarkets(nm));
    };

    getMarkets();
  }, [
    signer,
    supportedTokenPairs,
    comptrollerAddress,
    pollingKey,
    currentTransaction,
    secondsPerBlock
  ]);

  return markets;
}
