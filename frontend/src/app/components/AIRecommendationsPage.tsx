import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Shield, AlertTriangle, Lightbulb, CheckCircle2, ExternalLink, BookOpen } from 'lucide-react';

interface SecurityAdvisory {
  id: string;
  relatedAlertType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  mitigationSteps: string[];
  bestPractices: string[];
  references: string[];
  confidence: number;
  category: string;
}

const advisories: SecurityAdvisory[] = [
  {
    id: 'ADV-2024-001',
    relatedAlertType: 'Brute Force Attack',
    severity: 'critical',
    title: 'Prevent Credential-Based Brute Force Attacks',
    description: 'Multiple failed authentication attempts detected from a single source. Implement immediate protective measures to prevent account compromise.',
    mitigationSteps: [
      'Enable account lockout policies after 5 failed login attempts',
      'Implement progressive delays between failed authentication attempts',
      'Deploy rate limiting on authentication endpoints (max 10 attempts per minute)',
      'Enable CAPTCHA challenges after 3 failed attempts',
      'Configure IP-based blocking for repeated failures from same source',
      'Enable multi-factor authentication (MFA) for all user accounts',
      'Monitor authentication logs for patterns of distributed attacks',
    ],
    bestPractices: [
      'Use strong password policies requiring minimum 12 characters with complexity',
      'Implement password rotation every 90 days for privileged accounts',
      'Deploy a Web Application Firewall (WAF) with brute force protection',
      'Use adaptive authentication that considers user behavior and context',
      'Implement geolocation-based access controls to block suspicious regions',
      'Regular security awareness training for users on password security',
      'Consider passwordless authentication methods like FIDO2 or biometrics',
    ],
    references: [
      'NIST SP 800-63B: Digital Identity Guidelines',
      'OWASP Authentication Cheat Sheet',
      'CIS Controls v8: Account Management',
    ],
    confidence: 95,
    category: 'Authentication',
  },
  {
    id: 'ADV-2024-002',
    relatedAlertType: 'SQL Injection',
    severity: 'critical',
    title: 'Mitigate SQL Injection Vulnerabilities',
    description: 'SQL injection patterns detected in HTTP requests. Immediate action required to prevent data breach and unauthorized database access.',
    mitigationSteps: [
      'Use parameterized queries or prepared statements for all database interactions',
      'Implement input validation and sanitization on all user-supplied data',
      'Apply principle of least privilege to database accounts',
      'Enable SQL injection detection rules in Web Application Firewall',
      'Conduct immediate code review of affected endpoints',
      'Deploy database activity monitoring and alerting',
      'Update and patch database management systems to latest versions',
      'Implement web application firewalls with SQL injection signatures',
    ],
    bestPractices: [
      'Use ORM frameworks that automatically handle query parameterization',
      'Implement allow-lists for input validation rather than deny-lists',
      'Escape special characters in all user inputs before database queries',
      'Disable detailed error messages in production environments',
      'Regular penetration testing and vulnerability scanning',
      'Code security reviews as part of development lifecycle',
      'Implement Content Security Policy (CSP) headers',
    ],
    references: [
      'OWASP Top 10: Injection Flaws',
      'CWE-89: SQL Injection',
      'SANS Top 25 Most Dangerous Software Errors',
    ],
    confidence: 98,
    category: 'Web Security',
  },
  {
    id: 'ADV-2024-003',
    relatedAlertType: 'Privilege Escalation',
    severity: 'high',
    title: 'Prevent Unauthorized Privilege Elevation',
    description: 'Unauthorized attempts to gain elevated system privileges detected. Strengthen access controls and monitoring.',
    mitigationSteps: [
      'Review and audit all user permissions and role assignments',
      'Implement just-in-time (JIT) privileged access management',
      'Enable privilege escalation monitoring and alerting',
      'Remove unnecessary administrative privileges from standard users',
      'Implement sudo logging and monitoring for Linux systems',
      'Deploy Privileged Access Management (PAM) solution',
      'Conduct immediate investigation of affected user accounts',
      'Enable User Account Control (UAC) on Windows systems',
    ],
    bestPractices: [
      'Follow principle of least privilege for all accounts',
      'Separate administrative and standard user accounts',
      'Require approval workflows for privilege elevation requests',
      'Regular access reviews and recertification (quarterly)',
      'Implement session recording for privileged activities',
      'Use bastion hosts or jump servers for administrative access',
      'Enable comprehensive audit logging for privileged operations',
    ],
    references: [
      'NIST SP 800-53: Access Control',
      'CIS Critical Security Control 5: Account Management',
      'MITRE ATT&CK: Privilege Escalation',
    ],
    confidence: 92,
    category: 'Access Control',
  },
  {
    id: 'ADV-2024-004',
    relatedAlertType: 'Malware Detection',
    severity: 'critical',
    title: 'Respond to Malware Infections',
    description: 'Known malware signatures detected in system files or network traffic. Immediate containment and remediation required.',
    mitigationSteps: [
      'Isolate infected systems from the network immediately',
      'Run full antivirus/anti-malware scans on affected systems',
      'Review and terminate suspicious processes',
      'Analyze malware behavior using sandbox environment',
      'Check for lateral movement indicators across network',
      'Reset credentials for accounts on compromised systems',
      'Restore systems from known good backups if severely compromised',
      'Update antivirus signatures and scan all connected systems',
    ],
    bestPractices: [
      'Deploy next-generation antivirus with behavioral analysis',
      'Implement application whitelisting on critical systems',
      'Enable email filtering with attachment sandboxing',
      'Regular security awareness training on phishing and social engineering',
      'Keep all systems and applications patched and up-to-date',
      'Implement network segmentation to limit malware spread',
      'Maintain offline backups for critical systems and data',
    ],
    references: [
      'NIST Cybersecurity Framework: Detect and Respond',
      'SANS Incident Response Process',
      'CISA Malware Analysis Guide',
    ],
    confidence: 96,
    category: 'Malware',
  },
  {
    id: 'ADV-2024-005',
    relatedAlertType: 'Data Exfiltration',
    severity: 'critical',
    title: 'Detect and Prevent Data Exfiltration',
    description: 'Unusual outbound data transfer patterns detected. Potential data breach in progress requiring immediate investigation.',
    mitigationSteps: [
      'Block suspicious outbound connections at firewall level',
      'Analyze destination IPs and domains for known malicious infrastructure',
      'Review data access logs to identify compromised accounts',
      'Implement Data Loss Prevention (DLP) rules for sensitive data',
      'Monitor and restrict USB and removable media usage',
      'Enable cloud access security broker (CASB) controls',
      'Investigate all recent file access and transfer activities',
      'Deploy network traffic analysis to identify abnormal patterns',
    ],
    bestPractices: [
      'Classify and label sensitive data across the organization',
      'Implement encryption for data at rest and in transit',
      'Deploy endpoint DLP solutions on all workstations',
      'Monitor cloud storage and file sharing services',
      'Implement egress filtering and traffic inspection',
      'Regular data access audits and user behavior analytics',
      'Establish baseline for normal data transfer patterns',
    ],
    references: [
      'NIST SP 800-171: Protecting Controlled Unclassified Information',
      'PCI DSS Requirements for Data Protection',
      'GDPR Data Protection Guidelines',
    ],
    confidence: 94,
    category: 'Data Loss',
  },
  {
    id: 'ADV-2024-006',
    relatedAlertType: 'Lateral Movement',
    severity: 'high',
    title: 'Stop Lateral Movement Within Network',
    description: 'Unusual internal network access patterns detected. Attacker may be moving laterally through your infrastructure.',
    mitigationSteps: [
      'Segment network to limit lateral movement paths',
      'Disable SMB v1 protocol across all systems',
      'Monitor and restrict administrative share access',
      'Implement zero-trust network architecture',
      'Enable logging for all inter-system communications',
      'Review and restrict service account permissions',
      'Deploy network access control (NAC) solutions',
      'Investigate suspicious RDP and SSH connections',
    ],
    bestPractices: [
      'Implement micro-segmentation for critical assets',
      'Use jump servers for administrative access',
      'Deploy deception technology (honeypots) to detect attackers',
      'Regular network vulnerability assessments',
      'Implement host-based firewalls on all endpoints',
      'Monitor for Pass-the-Hash and Pass-the-Ticket attacks',
      'Require MFA for all remote access and privileged operations',
    ],
    references: [
      'MITRE ATT&CK: Lateral Movement Techniques',
      'NIST Zero Trust Architecture',
      'CIS Network Security Controls',
    ],
    confidence: 89,
    category: 'Network',
  },
  {
    id: 'ADV-2024-007',
    relatedAlertType: 'Phishing Attempt',
    severity: 'medium',
    title: 'Protect Against Phishing and Social Engineering',
    description: 'Phishing emails or suspicious links detected. Enhance email security and user awareness.',
    mitigationSteps: [
      'Block sender domain and add to email blacklist',
      'Scan all emails from sender for malicious attachments',
      'Alert users who received or interacted with phishing emails',
      'Enable email authentication (SPF, DKIM, DMARC)',
      'Deploy advanced email filtering with URL rewriting',
      'Review credentials entered on phishing sites and reset immediately',
      'Implement email banner warnings for external senders',
      'Report phishing domains to appropriate authorities',
    ],
    bestPractices: [
      'Conduct regular phishing simulation campaigns',
      'Provide security awareness training quarterly',
      'Implement email sandboxing for suspicious attachments',
      'Use browser isolation for unknown links',
      'Deploy anti-phishing browser extensions',
      'Establish clear incident reporting procedures for users',
      'Monitor for credential leaks on dark web and breach databases',
    ],
    references: [
      'CISA Phishing Awareness Resources',
      'SANS Security Awareness Training',
      'Anti-Phishing Working Group Guidelines',
    ],
    confidence: 87,
    category: 'Social Engineering',
  },
  {
    id: 'ADV-2024-008',
    relatedAlertType: 'Ransomware Behavior',
    severity: 'critical',
    title: 'Ransomware Prevention and Response',
    description: 'File encryption patterns typical of ransomware detected. Execute ransomware response plan immediately.',
    mitigationSteps: [
      'Immediately isolate affected systems from network',
      'Disable all network shares and remote access',
      'Identify ransomware variant using file extensions and ransom notes',
      'Check for available decryption tools for identified variant',
      'Do NOT pay ransom - contact law enforcement and cybersecurity experts',
      'Restore systems from clean, verified backups',
      'Scan all backup media before restoration',
      'Document all actions for forensic analysis and legal purposes',
    ],
    bestPractices: [
      'Implement 3-2-1 backup strategy (3 copies, 2 media types, 1 offsite)',
      'Test backup restoration procedures monthly',
      'Keep offline backups disconnected from network',
      'Deploy endpoint detection and response (EDR) solutions',
      'Enable controlled folder access on Windows systems',
      'Maintain updated inventory of all systems and data',
      'Develop and test incident response plan for ransomware',
    ],
    references: [
      'CISA Ransomware Guide',
      'No More Ransom Project Decryption Tools',
      'NIST Ransomware Risk Management',
    ],
    confidence: 97,
    category: 'Malware',
  },
  {
    id: 'ADV-2024-009',
    relatedAlertType: 'Unauthorized Access',
    severity: 'high',
    title: 'Respond to Unauthorized Access Attempts',
    description: 'Unauthorized access to systems or data detected. Immediate investigation and remediation required.',
    mitigationSteps: [
      'Immediately revoke access for suspicious accounts',
      'Review authentication logs for access patterns',
      'Reset passwords for potentially compromised accounts',
      'Enable enhanced monitoring for affected resources',
      'Conduct forensic analysis of access attempts',
      'Review and update access control lists (ACLs)',
      'Implement additional authentication requirements',
      'Document timeline and scope of unauthorized access',
    ],
    bestPractices: [
      'Implement continuous authentication and authorization',
      'Deploy User and Entity Behavior Analytics (UEBA)',
      'Regular access reviews and permission audits',
      'Implement time-based access restrictions',
      'Use context-aware access policies (location, device, time)',
      'Enable session timeout for inactive users',
      'Monitor for unusual access patterns and anomalies',
    ],
    references: [
      'ISO 27001: Access Control Standards',
      'NIST SP 800-53: Access Control Family',
      'CIS Control 6: Access Control Management',
    ],
    confidence: 91,
    category: 'Access Control',
  },
  {
    id: 'ADV-2024-010',
    relatedAlertType: 'DDoS Attack',
    severity: 'high',
    title: 'Mitigate Distributed Denial of Service Attacks',
    description: 'Abnormal traffic volumes detected indicating potential DDoS attack. Implement traffic filtering and mitigation.',
    mitigationSteps: [
      'Enable DDoS mitigation service at network edge',
      'Implement rate limiting on all public-facing services',
      'Configure geo-blocking for non-business critical regions',
      'Enable SYN flood protection on firewalls',
      'Scale infrastructure capacity if possible',
      'Work with ISP to implement upstream filtering',
      'Monitor traffic patterns and adjust mitigation rules',
      'Maintain communication with stakeholders during attack',
    ],
    bestPractices: [
      'Deploy Content Delivery Network (CDN) with DDoS protection',
      'Implement auto-scaling for cloud-based infrastructure',
      'Maintain DDoS response runbook and contact procedures',
      'Use anycast network architecture to distribute traffic',
      'Regular load testing and capacity planning',
      'Maintain relationships with DDoS mitigation vendors',
      'Monitor for amplification attack vulnerabilities (DNS, NTP)',
    ],
    references: [
      'NIST Guide to DDoS Attacks',
      'CISA DDoS Quick Guide',
      'Cloud Security Alliance DDoS Best Practices',
    ],
    confidence: 88,
    category: 'Network',
  },
];

export function AIRecommendationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAdvisories, setExpandedAdvisories] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const toggleExpanded = (advisoryId: string) => {
    setExpandedAdvisories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(advisoryId)) {
        newSet.delete(advisoryId);
      } else {
        newSet.add(advisoryId);
      }
      return newSet;
    });
  };

  const filteredAdvisories = advisories.filter(advisory => {
    const matchesSearch =
      advisory.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      advisory.relatedAlertType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      advisory.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      advisory.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || advisory.severity === severityFilter;
    const matchesCategory = categoryFilter === 'all' || advisory.category === categoryFilter;
    
    return matchesSearch && matchesSeverity && matchesCategory;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
      case 'high':
        return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
      case 'medium':
        return 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30';
      case 'low':
        return 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30';
      default:
        return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="size-5" />;
      default:
        return <Shield className="size-5" />;
    }
  };

  const categories = ['all', ...Array.from(new Set(advisories.map(a => a.category)))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-white mb-2">AI Recommendations</h1>
          <p className="text-gray-400">
            AI-powered security advisories and mitigation guidance • {filteredAdvisories.length} of {advisories.length} advisories shown
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5]/20 border border-[#4f46e5]/30 rounded">
          <Lightbulb className="size-5 text-[#4f46e5]" />
          <span className="text-sm text-[#4f46e5] font-medium">AI-Powered Insights</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search advisories by ID, alert type, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-12 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Severity Level</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Advisories List */}
      <div className="space-y-4">
        {filteredAdvisories.map((advisory) => {
          const isExpanded = expandedAdvisories.has(advisory.id);
          
          return (
            <div
              key={advisory.id}
              className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg overflow-hidden hover:border-[#2a2a3a] transition-colors"
            >
              {/* Advisory Header */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg ${getSeverityColor(advisory.severity)}`}>
                      {getSeverityIcon(advisory.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-gray-400 bg-[#1a1a24] px-2 py-1 rounded">
                          {advisory.id}
                        </span>
                        <span className={`text-xs px-2.5 py-1 border rounded ${getSeverityColor(advisory.severity)}`}>
                          {advisory.severity.toUpperCase()}
                        </span>
                        <span className="text-xs px-2.5 py-1 bg-[#1a1a24] text-gray-400 rounded">
                          {advisory.category}
                        </span>
                      </div>
                      <h3 className="text-xl text-white font-medium mb-2">
                        {advisory.title}
                      </h3>
                      <p className="text-sm text-gray-400 mb-3">
                        {advisory.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="size-4 text-[#f59e0b]" />
                          <span className="text-gray-300">
                            Related Alert: <span className="text-white font-medium">{advisory.relatedAlertType}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Lightbulb className="size-4 text-[#4f46e5]" />
                          <span className="text-gray-300">
                            AI Confidence: <span className="text-[#4f46e5] font-medium">{advisory.confidence}%</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mitigation Steps */}
                <div className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="size-5 text-[#10b981]" />
                    <h4 className="text-white font-medium">Mitigation Steps</h4>
                  </div>
                  <ul className="space-y-2.5">
                    {advisory.mitigationSteps.map((step, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-gray-300">
                        <span className="flex-shrink-0 size-6 flex items-center justify-center bg-[#4f46e5]/20 text-[#4f46e5] rounded-full text-xs font-medium mt-0.5">
                          {index + 1}
                        </span>
                        <span className="flex-1">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Best Practices - Expandable */}
                <div className="mt-4">
                  <button
                    onClick={() => toggleExpanded(advisory.id)}
                    className="flex items-center gap-2 text-[#4f46e5] hover:text-[#6366f1] transition-colors text-sm font-medium"
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    <BookOpen className="size-4" />
                    <span>Best Practices & Contextual Guidance</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 bg-[#0a0a0f] border border-[#4f46e5]/20 rounded-lg p-5 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="size-5 text-[#4f46e5]" />
                        <h4 className="text-white font-medium">Security Best Practices</h4>
                      </div>
                      <ul className="space-y-2.5 mb-5">
                        {advisory.bestPractices.map((practice, index) => (
                          <li key={index} className="flex items-start gap-3 text-sm text-gray-300">
                            <CheckCircle2 className="size-4 text-[#10b981] flex-shrink-0 mt-0.5" />
                            <span className="flex-1">{practice}</span>
                          </li>
                        ))}
                      </ul>

                      {/* References */}
                      <div className="pt-4 border-t border-[#1f1f2e]">
                        <div className="flex items-center gap-2 mb-3">
                          <ExternalLink className="size-4 text-gray-400" />
                          <h5 className="text-sm text-gray-400 font-medium">References & Standards</h5>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {advisory.references.map((ref, index) => (
                            <span
                              key={index}
                              className="text-xs px-3 py-1.5 bg-[#1a1a24] text-gray-300 rounded border border-[#2a2a3a] hover:border-[#4f46e5] transition-colors cursor-pointer"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* No Results */}
      {filteredAdvisories.length === 0 && (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-12 text-center">
          <Search className="size-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg text-white mb-2">No advisories found</h3>
          <p className="text-gray-400">
            Try adjusting your search query or filters
          </p>
        </div>
      )}
    </div>
  );
}
