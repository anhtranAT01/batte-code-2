import React from 'react';

export default class ViewBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="safety-panel space-y-3">
      <h2>Chưa mở được trang này</h2>
      <p>Hãy kiểm tra kết nối rồi tải lại ứng dụng. Bạn vẫn có thể chọn các mục khác trên thanh điều hướng.</p>
      <button type="button" className="primary-action" onClick={() => window.location.reload()}>Tải lại ứng dụng</button>
    </section>;
  }
}
