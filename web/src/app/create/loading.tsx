export default function CreateLoading() {
  return (
    <div className="form-wrap" aria-busy="true" aria-label="Loading creation form">
      <div className="form-head">
        <div className="loading-line loading-eyebrow" />
        <div className="loading-line loading-title" />
        <div className="loading-line loading-copy" />
      </div>
      <div className="form loading-form">
        <div className="loading-line loading-label" />
        <div className="loading-line loading-input" />
        <div className="loading-line loading-label" />
        <div className="loading-line loading-input" />
        <div className="loading-line loading-label" />
        <div className="loading-line loading-input" />
      </div>
    </div>
  );
}
