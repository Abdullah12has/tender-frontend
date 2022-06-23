import { useState, useContext } from "react";
import ReactModal from "react-modal";
import type { Market } from "~/types/global";
import BorrowFlow from "../borrow-flow";
import { TenderContext } from "~/contexts/tender-context";
import toast from "react-hot-toast";

ReactModal.setAppElement("#m");

export default function MarketRow(props: {
  market: Market;
  children: React.ReactChild[];
}) {
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>();
  /* Because the modal is nested in the <TR> we have to have an extra
   * layer of protection when toggling visibility to keep double calling
   */
  const [sillyMutex, setSillyMutex] = useState<boolean>(false);
  const openModal = () => {
    if (!sillyMutex) {
      setIsDepositModalOpen(true);
      setSillyMutex(true);
    } else {
      setSillyMutex(false);
    }
  };

  const closeModal = () => {
    setSillyMutex(true);
    setIsDepositModalOpen(false);
  };
  return (
    <tr
      onClick={() => openModal()}
      className="text-gray-400 border-t border-t-gray-600 cursor-pointer"
    >
      {props.children}

      <ReactModal
        shouldCloseOnOverlayClick={true}
        isOpen={!!isDepositModalOpen}
        onRequestClose={() => closeModal()}
        portalClassName="modal"
        style={{ content: {inset: "unset", margin: "50px auto", zoom: "80%", position:"relative", maxWidth: 600}}}
        closeTimeoutMS={200}
      >
        <BorrowFlow closeModal={() => closeModal()} market={props.market} />
      </ReactModal>
    </tr>
  );
}
